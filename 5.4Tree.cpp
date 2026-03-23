struct Node{
    int data;
    Node * firstchild;
    Node * nextsibling;
    Node(int val):data(val),firstchild(nullptr),nextsibling(nullptr){}
};
class tree{
private:
    Node * root;
    
}