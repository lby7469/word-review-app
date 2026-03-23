#include<iostream>
using namespace std;
struct Node{
    int val;
    Node * next;
    Node(int x):val(x),next(nullptr){}
};

class LinkedList{
private:
    Node* head;
    
public:
    LinkedList(){
        head=new Node(-1);
    }
    void Lsprint(){
        Node *p=head->next;
        while(p!=nullptr){
            cout<<p->val<<" ";
            p=p->next;
        }
        cout<<endl;
    }
    void insertTail( int val){
        Node *p=head;
        Node* n=new Node(val);
        while (p->next!=nullptr)
        {
            p=p->next;
        }
        p->next=n;
        
    }
    void insertHead(int val){
        Node*p=head->next;
        Node* n=new Node(val);
        head->next=n;
        n->next=p;
    }
    Node* findValue(int tval){
        Node*p=head->next;
        while(p!=nullptr)
        {
            if(p->val==tval){
                return p;
            }
            else{
                p=p->next;
            }
        } 
        return nullptr;
    }
    int getLen(){
        Node*p=head->next;
        int len=0;
        while(p!=nullptr){
            p=p->next;
            len++;
        }
        return len;
    }
    void deletVal(int tval){
        Node*p=head->next;
        Node*temp=head;
        while(p!=nullptr){
            if(p->val==tval){
                temp->next=p->next;
                delete p;
                return;
            }
            temp=temp->next;
            p=temp->next;
        }
        return;
    }
    void reverseLs(){
        int len=getLen();
        if(len>=1){
            
            Node*mid=head;
            Node*pre=nullptr;
        while(mid!=nullptr){
            Node*lat=head->next;
            mid->next=pre;
            pre=mid;
            mid=lat;
            
        }
        head->next=pre;
        }
        else{
            return ;
        }

    }
};

int main(){
    return 0;
}